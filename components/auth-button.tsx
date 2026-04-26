"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function AuthButton() {
    const { status, data } = useSession();

    if (status === "loading") {
        return <Button type="button" variant="secondary" size="sm" disabled>Loading...</Button>;
    }

    if (status === "authenticated") {
        return (
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                    {data.user?.name ?? data.user?.email ?? "Signed in"}
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => void signOut()}>
                    Sign out
                </Button>
            </div>
        );
    }

    return (
        <Button type="button" size="sm" onClick={() => void signIn("github")}>
            Sign in
        </Button>
    );
}