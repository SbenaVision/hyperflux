import { UserList } from "../../components/UserList";

export const metadata = { title: "Users — HyperFlux Admin" };

export default function UsersPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Users</h1>
        <span className="muted">15 total</span>
      </div>
      <UserList />
    </>
  );
}
