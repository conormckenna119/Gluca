import React from "react";
import { router } from "expo-router";
import { Group, ListRow } from "../ui";
import { useAccount } from "../hooks/use-account";

/** One row to the account screen. Renders nothing while the `accounts` flag is off. */
export function AccountEntry() {
  const { status } = useAccount();
  if (status === "off") return null;
  const open = () => router.push("/account");
  return (
    <Group>
      {status === "signedIn" ? (
        <ListRow
          title="Account"
          detail="Signed in on this device"
          icon="user"
          onPress={open}
        />
      ) : (
        <ListRow
          title="Sign in or create an account"
          detail={
            status === "unavailable" ? "Account server not running" : undefined
          }
          icon="user"
          onPress={open}
        />
      )}
    </Group>
  );
}
