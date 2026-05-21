import { PidButton } from "../../components/buttons/PidButton.js";
import { Glyph } from "../../components/glyph/index.js";
import { useGitStore } from "./useGitStore.js";

interface Props {
  projectId: string;
}

export function EmptyState({ projectId }: Props) {
  const initRepo = useGitStore((s) => s.initRepo);
  return (
    <div className="pid-git-empty-state">
      <div className="pid-git-empty-glyph" aria-hidden>
        <Glyph kind="git" size={28} />
      </div>
      <div className="pid-git-empty-title">Not a git repository</div>
      <p className="pid-git-empty-blurb">
        This project isn&rsquo;t tracked by git. Initialise a repo to enable the changes list,
        commit history, and the agent&rsquo;s file-touch trail.
      </p>
      <PidButton variant="primary" glyph="plus" onClick={() => void initRepo(projectId)}>
        Initialise repository
      </PidButton>
    </div>
  );
}
