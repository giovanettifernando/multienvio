/**
 * LayoutLoader - Fallback de carregamento para o layout principal
 * Usa tokens CSS para cores e espaçamentos
 */
import styles from './LayoutLoader.module.css';

export function LayoutLoader() {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} />
    </div>
  );
}
