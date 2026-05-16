import { useMemo } from "react";
import { PidIntroScreen } from "../../intro/PidIntroScreen";
import { useProjectsStore } from "../useProjectsStore";
import { useSessionsStore } from "../useSessionsStore";
import { ProjectSection } from "./ProjectSection";

export function PidSessionsOverview() {
  const projects = useProjectsStore((s) => s.projects);
  const sessionsByProject = useSessionsStore((s) => s.sessionsByProject);
  const loadingByProject = useSessionsStore((s) => s.loadingByProject);

  const { totalCached, anyLoading } = useMemo(() => {
    let total = 0;
    for (const p of projects) total += sessionsByProject[p.id]?.length ?? 0;
    const loading = projects.some((p) => loadingByProject[p.id]);
    return { totalCached: total, anyLoading: loading };
  }, [projects, sessionsByProject, loadingByProject]);

  if (projects.length === 0 || (totalCached === 0 && !anyLoading)) {
    return <PidIntroScreen variant="fullscreen" />;
  }

  return (
    <main className="pid-overview" aria-label="Sessions overview">
      <header className="pid-overview-heading">
        <span className="pid-overview-kicker">dashboard</span>
        <h1 className="pid-overview-title">
          all sessions <span className="pid-overview-kicker">· {totalCached}</span>
        </h1>
      </header>
      {projects.map((project) => (
        <ProjectSection key={project.id} project={project} />
      ))}
    </main>
  );
}
