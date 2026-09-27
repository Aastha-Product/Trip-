import { redirect } from "next/navigation";

/** Old links: preferences are now added right on the trip page. */
export default async function JoinPage(props: PageProps<"/t/[id]/join">) {
  const { id } = await props.params;
  redirect(`/t/${id}`);
}
