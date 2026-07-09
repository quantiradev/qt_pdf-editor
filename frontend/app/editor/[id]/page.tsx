import EditorLoader from "@/components/editor-studio/EditorLoader";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorLoader id={id} />;
}
