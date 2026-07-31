import Link from "next/link";
import styles from "./ViewNav.module.css";

type View = "repositories" | "pipelines";

interface ViewNavProps {
  readonly active: View;
}

const VIEWS: readonly { readonly view: View; readonly href: string; readonly label: string }[] = [
  { view: "repositories", href: "/", label: "By repository" },
  { view: "pipelines", href: "/pipelines", label: "By pipeline" },
];

/**
 * Toggle between the repository-oriented (`/`) and pipeline-oriented
 * (`/pipelines`) views. Plain links — no client-side JavaScript.
 */
export function ViewNav({ active }: ViewNavProps) {
  return (
    <nav className={styles.nav} aria-label="Dashboard view">
      {VIEWS.map(({ view, href, label }) => (
        <Link
          key={view}
          href={href}
          className={styles.link}
          aria-current={view === active ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
