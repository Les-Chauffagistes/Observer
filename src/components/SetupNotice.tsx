import styles from "./SetupNotice.module.css";

interface SetupNoticeProps {
  readonly message: string;
}

/**
 * Rendered when the application is not yet configured. Explains, in place, how
 * to provide the required environment variables rather than crashing.
 */
export function SetupNotice({ message }: SetupNoticeProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Configuration required</h1>
        <p className={styles.message}>{message}</p>

        <p className={styles.hint}>
          Create a <code>.env.local</code> file at the project root:
        </p>
        <pre className={styles.code}>
          {`# Required
GITHUB_TOKEN=ghp_your_token_with_actions_read

# Pick at least one repository source
GITHUB_ORG=your-org
GITHUB_REPOS=owner/service-a, owner/service-b`}
        </pre>

        <p className={styles.hint}>
          Then restart the dev server. See <code>.env.example</code> for all
          options, and <code>observer.config.example.json</code> to organise
          repositories into folders.
        </p>
      </div>
    </div>
  );
}
