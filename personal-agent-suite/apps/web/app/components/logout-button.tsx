import { signOut } from "../../auth";

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/auth/signin" });
      }}
    >
      <button
        type="submit"
        style={{
          border: "1px solid var(--panel-border)",
          borderRadius: 999,
          padding: "10px 14px",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer"
        }}
      >
        Sign out
      </button>
    </form>
  );
}
