import UserList from "@/components/UserList";

export default function UsersPage() {
  return (
    <div>
      <div className="page-header">
        {/* Hardcoded page title */}
        <h1 className="page-title">Users</h1>
        <p className="page-subtitle">Manage and review all registered accounts.</p>
      </div>
      <UserList />
    </div>
  );
}
