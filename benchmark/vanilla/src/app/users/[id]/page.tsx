import { notFound } from "next/navigation";
import { MOCK_USERS } from "@/lib/data";
import UserDetail from "@/components/UserDetail";

interface Props {
  params: { id: string };
}

export function generateStaticParams() {
  return MOCK_USERS.map((u) => ({ id: u.id }));
}

export default function UserDetailPage({ params }: Props) {
  const user = MOCK_USERS.find((u) => u.id === params.id);
  if (!user) notFound();

  return (
    <div>
      <div className="page-header">
        {/* Hardcoded page title prefix */}
        <h1 className="page-title">User Profile</h1>
        <p className="page-subtitle">{user.email}</p>
      </div>
      <UserDetail user={user} />
    </div>
  );
}
