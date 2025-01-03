'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IconX } from '@tabler/icons-react';
import { lookupMovie } from '@/lib/lookupMovie';
import { Input } from '@/components/Input';
import { MovieResultList } from './MovieResultList';

export function ChooseMovieModal({
  initialValue = '',
  onSelect,
  imageConfig,
  setShowModal,
}) {
  const [val, setVal] = useState(initialValue);
  const [movies, setMovies] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [disableHoverSelect, setDisableHoverSelect] = useState(false);
  const ref = useRef();

  const onMovieChange = useCallback(
    pattern => {
      setVal(pattern);
    },
    [setVal],
  );

  const cancelSearch = useCallback(() => setShowModal(false), [setShowModal]);

  const onKeyDown = useCallback(event => {
    if (event.code === 'ArrowUp') {
      event.preventDefault();
      setDisableHoverSelect(true);
      setSelectedIndex(selectedIndex === 0 ? 0 : selectedIndex - 1);
    } else if (event.code === 'ArrowDown') {
      event.preventDefault();
      setDisableHoverSelect(true);
      setSelectedIndex(
        selectedIndex === movies.length - 1 ? 0 : selectedIndex + 1,
      );
    } else if (event.code === 'Enter') {
      event.preventDefault();
      setDisableHoverSelect(false);
      onSelect(movies[selectedIndex], true);
    } else if (event.code === 'Escape') {
      event.preventDefault();
      setDisableHoverSelect(false);
      cancelSearch();
    } else {
      setDisableHoverSelect(false);
      setSelectedIndex(0);
    }
  });

  useEffect(() => {
    if (ref?.current) {
      ref.current.focus();
    }
  }, [ref]);

  let useThisResult = true;

  useEffect(() => {
    async function doAction() {
      const results = await lookupMovie(val);
      if (useThisResult) {
        setMovies(results);
      }
    }

    if (val) {
      doAction();
    }

    return () => (useThisResult = false);
  }, [val]);

  return (
    <div className="w-full">
      <div className="pt-4 pb-6 flex justify-end">
        <button className="p-2 flex" onClick={cancelSearch}>
          <IconX />
        </button>
      </div>
      <section className="text-center">
        <Input
          id="movie"
          label="Search for a movie"
          onChange={onMovieChange}
          value={val}
          ref={ref}
          onKeyDown={onKeyDown}
        />
      </section>
      <section>
        <MovieResultList
          movies={movies}
          onSelect={onSelect}
          imageConfig={imageConfig}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          disableHoverSelect={disableHoverSelect}
        />
      </section>
    </div>
  );
}
