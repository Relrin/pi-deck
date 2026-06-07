import { beforeEach, describe, expect, test } from "bun:test";
import {
  type PromptImageDraft,
  useIntroComposerStore,
} from "../../../src/features/intro/useIntroComposerStore";

function makeImage(id: string): PromptImageDraft {
  return {
    id,
    mimeType: "image/png",
    data: "AA==",
    thumbnailDataUrl: "data:image/webp;base64,UA==",
    name: `${id}.png`,
    byteSize: 1,
  };
}

beforeEach(() => {
  useIntroComposerStore.setState({ images: [] });
});

describe("useIntroComposerStore — images slice", () => {
  test("addImages appends and de-dupes by id", () => {
    const { addImages } = useIntroComposerStore.getState();
    addImages([makeImage("a"), makeImage("b")]);
    addImages([makeImage("b"), makeImage("c")]);
    expect(useIntroComposerStore.getState().images.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  test("removeImage drops the matching id only", () => {
    useIntroComposerStore.setState({ images: [makeImage("a"), makeImage("b")] });
    useIntroComposerStore.getState().removeImage("a");
    expect(useIntroComposerStore.getState().images.map((i) => i.id)).toEqual(["b"]);
  });

  test("clearImages empties the queue", () => {
    useIntroComposerStore.setState({ images: [makeImage("a"), makeImage("b")] });
    useIntroComposerStore.getState().clearImages();
    expect(useIntroComposerStore.getState().images).toEqual([]);
  });

  test("`clear` empties both attachments and images, plus text", () => {
    useIntroComposerStore.setState({
      images: [makeImage("a")],
      attachments: [{ kind: "file", path: "/x" }],
      text: "hello",
    });
    useIntroComposerStore.getState().clear();
    const s = useIntroComposerStore.getState();
    expect(s.images).toEqual([]);
    expect(s.attachments).toEqual([]);
    expect(s.text).toBe("");
  });
});
