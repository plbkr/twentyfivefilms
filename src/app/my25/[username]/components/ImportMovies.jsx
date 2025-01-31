'use client';

import React, { useState } from 'react';
import { importMovieList } from '@/lib/importMovieList';
import { INVALID_URL_ERROR } from '@/lib/constants';

export function ImportMovies({ onImportSuccess, onImportFailure }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setIsExpanded(false);
    setIsImporting(true);
    try {
      const importedMovies = await importMovieList(inputValue);
      onImportSuccess(importedMovies);
    } catch (error) {
      // check if error is due to size too large
      if (error.message.includes('Exceeded maximum')) {
        onImportFailure(error.message);
      } else if (error.message === INVALID_URL_ERROR) {
        onImportFailure(
          'The url is invalid. It must be a public Letterboxd list URL.'
        );
      } else {
        console.error('Error importing movies:', error);
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center m-2">
      {isExpanded ? (
        <div className="flex flex-row items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter Public Letterboxd List URL"
            className="border border-gray-300 text-gray-900 text-base rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 m-2 w-64 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          />
          <button
            onClick={handleImport}
            className="p-2 m-2 bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-300"
          >
            Import
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="p-2 m-2 bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-300"
        >
          {isImporting ? 'Importing...' : 'Import From Letterboxd'}
        </button>
      )}
    </div>
  );
}
