'use client';

import React from 'react';

export function AlertBox({ alert: { message, style }, visible }) {
  const styleClass =
    style === 'success'
      ? 'bg-green-300 dark:bg-green-800 border-green-500 dark:green-yellow-600'
      : style === 'warning'
        ? 'bg-yellow-300 dark:bg-yellow-800 border-yellow-500 dark:border-yellow-600'
        : style === 'danger'
          ? 'bg-red-300 dark:bg-red-800 border-red-500 dark:border-red-600'
          : 'bg-white border-gray-500 dark:bg-black';
  const transitionStyle = visible
    ? { transition: 'top 0.5s ease 0s', top: '-2px' }
    : { transition: 'top 0.2s ease 0s' };

  return (
    <div
      className={`border-2 p-2 fixed h-[50px] top-[-50px] ${styleClass}`}
      style={transitionStyle}>
      {message}
    </div>
  );
}
