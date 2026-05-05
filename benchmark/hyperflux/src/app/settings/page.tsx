import { SettingsForm } from "../../components/SettingsForm";

export const metadata = { title: "Settings — HyperFlux Admin" };

export default function SettingsPage() {
  return (
    <>
      <h1 className="page-title">Settings</h1>
      <SettingsForm />
    </>
  );
}
