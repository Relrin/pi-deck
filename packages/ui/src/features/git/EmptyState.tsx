import { PidButton } from "../../components/buttons/PidButton.js";
import { GitBranch, Plus } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import { useGitStore } from "./useGitStore.js";

interface Props {
  projectId: string;
}

export function EmptyState({ projectId }: Props) {
  const { LL } = useI18nContext();
  const initRepo = useGitStore((s) => s.initRepo);
  return (
    <div className="pid-git-empty-state">
      <div className="pid-git-empty-glyph" aria-hidden>
        <GitBranch size={28} />
      </div>
      <div className="pid-git-empty-title">{LL.git.empty.title()}</div>
      <p className="pid-git-empty-blurb">{LL.git.empty.blurb()}</p>
      <PidButton
        variant="primary"
        icon={<Plus size={14} />}
        onClick={() => void initRepo(projectId)}
      >
        {LL.git.empty.init()}
      </PidButton>
    </div>
  );
}
