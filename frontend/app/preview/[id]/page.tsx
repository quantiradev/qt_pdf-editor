import PreviewerLoader from "@/components/editor-studio/PreviewerLoader";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PreviewerLoader id={id} />;
}
