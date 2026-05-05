import { notFound } from "next/navigation";
import Link from "next/link";
import { getUserById } from "../../../lib/data";
import { UserDetail } from "../../../components/UserDetail";

interface Props {
  params: { id: string };
}

export function generateMetadata({ params }: Props) {
  const user = getUserById(params.id);
  return { title: user ? `${user.name} — HyperFlux Admin` : "User Not Found" };
}

export default function UserDetailPage({ params }: Props) {
  const user = getUserById(params.id);
  if (!user) notFound();

  return (
    <>
      <Link href="/users" className="back-link">
        ← Back to Users
      </Link>
      <UserDetail user={user} />
    </>
  );
}
