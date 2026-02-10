import React from 'react';
import { diffWords } from 'diff';
import styles from './runs.module.scss';

interface DiffViewProps {
  expected: string;
  actual: string;
}

export function DiffView({ expected, actual }: DiffViewProps) {
  const changes = diffWords(expected, actual);

  return (
    <div className={styles.diffView}>
      <div className={styles.diffLegend}>
        <span className={styles.diffLegendItem}>
          <span className={`${styles.diffSwatch} ${styles.diffAdded}`} /> Added
        </span>
        <span className={styles.diffLegendItem}>
          <span className={`${styles.diffSwatch} ${styles.diffRemoved}`} /> Removed
        </span>
        <span className={styles.diffLegendItem}>
          <span className={styles.diffSwatch} /> Unchanged
        </span>
      </div>
      <div className={styles.diffContent}>
        {changes.map((part, i) => {
          if (part.added) {
            return (
              <span key={i} className={styles.diffAdded}>
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={i} className={styles.diffRemoved}>
                {part.value}
              </span>
            );
          }
          return <span key={i}>{part.value}</span>;
        })}
      </div>
    </div>
  );
}
