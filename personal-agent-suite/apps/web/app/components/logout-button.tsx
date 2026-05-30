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
        className="rounded-full border border-white/20 bg-transparent px-3.5 py-2.5 text-sm text-[#f2ebdf] transition hover:bg-white/[0.05] focus:outline-none focus:ring-4 focus:ring-accent/10"
      >
        Sign out
      </button>
    </form>
  );
}
