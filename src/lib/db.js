'use server';

import { MovieListType, PrismaClient } from '@prisma/client';
import { createHmac } from 'crypto';
import * as session from '@/lib/session';
import * as logger from './logger';
import { INITIAL_LISTS } from '@/lib/constants';

const STATIC_SECRET = 'my_secret';
const prisma = new PrismaClient({
  omit: {
    user: {
      hashed_password: true
    }
  }
});

export async function hashPassword(password) {
  const hmac = createHmac('sha256', STATIC_SECRET);
  hmac.update(password);
  return hmac.digest('hex');
}

export async function createUser({ username, password, slack_user_id = null }) {
  const existingUser = await prisma.user.findFirst({ where: { username } });
  if (existingUser) {
    throw new Error(`User ${username} already exists`, {
      statusCode: 409,
      databaseResponse: existingUser
    });
  }

  const hashed_password = await hashPassword(password);

  const created = await prisma.user.create({
    data: {
      username,
      hashed_password,
      slack_user_id
    }
  });

  delete created.hashed_password;
  return created;
}

export async function loginUser({ username, password }) {
  logger.debug('Logging in', { username, password });
  const user = await prisma.user.findFirst({
    select: {
      username: true,
      hashed_password: true
    },
    where: {
      username
    }
  });

  const verifyHashedPassword = await hashPassword(password);

  if (!user || user.hashed_password !== verifyHashedPassword) {
    if (!user) {
      logger.debug('User was not found', username);
    } else {
      logger.debug('Passwords did not match');
    }
    return { error: 'LoginError', message: 'Username or password incorrect' };
  }

  delete user.hashed_password;
  logger.debug('Found user', user);
  await session.setSession({ user });
  return user;
}

function makePassword(length) {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_*&%^$#@!';
  const charactersLength = characters.length;
  while (result.length < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export async function generateAuthTokenForSlackUser({
  username,
  slack_user_id
}) {
  await logger.debug(
    'Generating auth token for slack user',
    username,
    ' - ',
    slack_user_id
  );

  // Find this user by their slack USER ID (slack user usernames can change)
  const user = await prisma.user.findFirst({
    where: { slack_user_id }
  });

  await logger.debug(
    () =>
      `Lookup for user with slack_user_id ${slack_user_id} complete, user is ${JSON.stringify(user)}`
  );

  if (!user) {
    const password = makePassword(28);
    await logger.debug(`User did not exist, creating new user`);
    await createUser({ username, slack_user_id, password });
    await logger.debug(
      `Attempting to recreate the auth token now that the user is created`
    );
    return await generateAuthTokenForSlackUser({ username, slack_user_id });
  }

  await logger.debug(`User existed, checking to make sure usernames match`);
  if (user.username !== username) {
    await logger.debug(
      `Usernames did not match, ${user.username} vs ${username}, updating record now`
    );
    try {
      await prisma.user.update({ where: { id: user.id }, data: { username } });
    } catch (error) {
      // log and swallow
      logger.error(
        `An error occurred while updating usernames that did not match ${user.username} vs. ${username}. Error message: ${error.message || error}`
      );
    }
  }

  await logger.debug(`Creating new token`);
  try {
    const token = await prisma.token.create({
      data: { user_id: user.id }
    });

    await logger.debug(() => `Token created, ${JSON.stringify(token)}`);
    return token;
  } catch (error) {
    await logger.debug(() => 'Error creating new token', JSON.stringify(error));
    throw error;
  }
}

export async function getAuthTokenRecord({ token }) {
  return await prisma.token.findUnique({
    where: { id: token },
    include: {
      user: true
    }
  });
}

function sortMoviesIntoLists(movies) {
  const init = INITIAL_LISTS;

  if (!movies) {
    return init;
  }

  return movies.reduce((results, entry) => {
    results[entry.type].push(entry.movie);
    return results;
  }, init);
}

export async function getLists({ user_id }) {
  logger.debug(`Attempting to get lists for user ${user_id}`);
  const movies = await prisma.listEntry.findMany({
    where: {
      user_id
    },
    orderBy: [
      {
        order: 'asc'
      }
    ],
    include: {
      movie: true
    }
  });

  await logger.debug(() => `movies result: ${JSON.stringify(movies)}`);

  return sortMoviesIntoLists(movies);
}

// lists should be an array of { type, movies }
export async function saveLists({ user_id, lists }) {
  const types = lists.map((list) => list.type);

  // wishing I had TypeScript right now
  const validTypes = Object.values(MovieListType);
  if (types.some((t) => !validTypes.includes(t))) {
    throw new Error(
      `Invalid type included in saveLists call, lists not saved (${types.join(', ')})`
    );
  }

  let counters = { FAVORITE: 1, HM: 1, QUEUE: 1 };

  await logger.debug(
    () =>
      `Attempting transaction where first step will be to delete many where user_id=${user_id} and types IN (${types.join(', ')})`
  );

  const [createdMovies, deletedEntries, createdEntries] =
    await prisma.$transaction([
      // Step 1: Upsert all incoming movies to be sure they're added
      prisma.movie.createMany({
        data: lists.flatMap((list) =>
          list.movies.map(({ id, title, release_date, poster_path }) => ({
            id,
            title,
            release_date,
            poster_path
          }))
        ),
        skipDuplicates: true
      }),
      // Step 2: Delete all incoming list entries (by type+user_id)
      prisma.listEntry.deleteMany({
        where: {
          user_id,
          type: {
            in: types
          }
        }
      }),
      // Step 2: Create all of the new entries, adding correct order value
      prisma.listEntry.createManyAndReturn({
        data: lists.flatMap(({ type, movies }) => {
          return movies.map((m) => ({
            movie_id: m.id,
            user_id,
            type,
            order: counters[type]++
          }));
        }),
        include: {
          movie: true
        }
      })
    ]);

  await logger.debug(() => [
    `Deleted / created requested lists (user: ${user_id}, types: ${types.join(', ')})`,
    JSON.stringify({
      request: { user_id, lists },
      deleted,
      created
    })
  ]);

  return {
    createdMovies,
    deletedEntries,
    createdEntries,
    lists: sortMoviesIntoLists(created)
  };
}
