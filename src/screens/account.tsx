import React, { useState } from "react";
import { View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Group,
  IconButton,
  Input,
  Notice,
  SwitchRow,
  T,
  space,
} from "../ui";
import { Page } from "../components/page";
import { useAccount } from "../hooks/use-account";
import { useDemo } from "../store";
import { ConnectionError } from "../services/dexcom-oauth";
import { isEnabled } from "../flags";
import { BRAND } from "../art/brand";
import {
  NOT_RUNNING,
  canSubmit,
  messageFor,
  normalizeUsername,
  passphraseHint,
  validateConfirm,
  validatePassphrase,
  validateUsername,
  type AccountMode,
} from "../account-form";

const codeOf = (e: unknown) =>
  e instanceof ConnectionError ? e.code : "unavailable";

/** Show a rule's message only once the person has typed past the first characters. */
const after = (value: string, n: number, msg: string | null) =>
  value.length >= n ? msg : null;

function FieldError({ message }: { message: string | null }) {
  return (
    <View accessibilityLiveRegion="polite">
      {message ? <T small bold>{`Check this: ${message}`}</T> : null}
    </View>
  );
}

function PassphraseField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  shown,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "new-password" | "current-password";
  hint?: string;
  shown: boolean;
  /** Only one field in a form carries the show/hide button. */
  onToggle?: () => void;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Input
        label={label}
        value={value}
        onChange={onChange}
        secureTextEntry={!shown}
        autoComplete={autoComplete}
        maxLength={128}
      />
      {onToggle || hint ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
        >
          {onToggle ? (
            <IconButton
              icon={shown ? "eye-off" : "eye"}
              label={shown ? "Hide passphrase" : "Show passphrase"}
              onPress={onToggle}
            />
          ) : null}
          {hint ? (
            <T small muted>
              {hint}
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SignedIn({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: space.lg }}>
      <Card>
        <T heading>You are signed in on this device</T>
        <T muted>
          Signing out ends the session here. Your graphics and profile answers
          stay on this device.
        </T>
      </Card>
      {error ? (
        <Notice tone="error" title="Could not sign out">
          {error}
        </Notice>
      ) : null}
      <Button
        kind="primary"
        label="Go to profile"
        onPress={() => router.replace("/profile")}
      />
      <Button
        label={busy ? "Signing out…" : "Sign out"}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await onSignOut();
          } catch (e) {
            setError(messageFor(codeOf(e), "signIn"));
          }
          setBusy(false);
        }}
      />
    </View>
  );
}

function SignInForm({
  signIn,
}: {
  signIn: (u: string, p: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = canSubmit("signIn", { username, passphrase });
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(normalizeUsername(username), passphrase);
      setPassphrase("");
      router.replace("/profile");
    } catch (e) {
      setError(messageFor(codeOf(e), "signIn"));
      setPassphrase("");
    }
    setBusy(false);
  };
  return (
    <View style={{ gap: space.lg }}>
      <Input
        label="Username"
        value={username}
        onChange={setUsername}
        plainText
        autoComplete="username"
        maxLength={40}
      />
      <FieldError message={after(username, 3, validateUsername(username))} />
      <PassphraseField
        label="Passphrase"
        value={passphrase}
        onChange={setPassphrase}
        autoComplete="current-password"
        shown={shown}
        onToggle={() => setShown((s) => !s)}
      />
      {error ? (
        <Notice tone="error" title="Could not sign in">
          {error}
        </Notice>
      ) : null}
      <Button
        kind="primary"
        label={busy ? "Signing in…" : "Sign in"}
        disabled={!ok || busy}
        onPress={submit}
      />
      <T small muted>
        Passphrases cannot be recovered yet. These are sandbox test accounts.
      </T>
    </View>
  );
}

function Explainer() {
  return (
    <Card tone="raised">
      <T heading>{`What a ${BRAND.name} account is for`}</T>
      <T small>
        Today an account lets you connect a Dexcom sandbox account and, later,
        sync. These are sandbox test accounts with no password recovery yet.
      </T>
      <T small>
        Your profile answers stay on this device. Glucose data is never needed
        to create an account.
      </T>
    </Card>
  );
}

function CreateForm({
  register,
}: {
  register: (u: string, p: string) => Promise<void>;
}) {
  const { set } = useDemo();
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [age, setAge] = useState(false);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = { username, passphrase, confirm, ageConfirmed: age };
  const ok = canSubmit("create", fields);
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await register(normalizeUsername(username), passphrase);
      // Optional onboarding is separate from account registration and Dexcom authorization.
      setPassphrase("");
      setConfirm("");
      set((s) => ({ ...s, profile: { ...s.profile, ageConfirmed: true } }));
      router.replace(
        isEnabled("identity") ? "/onboarding?from=account" : "/profile",
      );
    } catch (e) {
      setError(messageFor(codeOf(e), "create"));
      setPassphrase("");
      setConfirm("");
    }
    setBusy(false);
  };
  return (
    <View style={{ gap: space.lg }}>
      <Explainer />
      <Input
        label="Username"
        value={username}
        onChange={setUsername}
        plainText
        autoComplete="username"
        maxLength={40}
      />
      <FieldError message={after(username, 3, validateUsername(username))} />
      <PassphraseField
        label="Passphrase"
        value={passphrase}
        onChange={setPassphrase}
        autoComplete="new-password"
        hint={passphraseHint(passphrase.length)}
        shown={shown}
        onToggle={() => setShown((s) => !s)}
      />
      <FieldError
        message={after(passphrase, 4, validatePassphrase(passphrase, username))}
      />
      <PassphraseField
        label="Confirm passphrase"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        shown={shown}
      />
      <FieldError
        message={
          passphrase && confirm.length >= passphrase.length
            ? validateConfirm(passphrase, confirm)
            : null
        }
      />
      <T small muted>
        Use a new passphrase for {BRAND.name}. Never use your Dexcom password
        here.
      </T>
      <Group>
        <SwitchRow
          title="I am old enough to use this app"
          detail="A minimum age has not been set yet; this will be updated before any public release."
          value={age}
          onChange={setAge}
        />
      </Group>
      {error ? (
        <Notice tone="error" title="Could not create the account">
          {error}
        </Notice>
      ) : null}
      <Button
        kind="primary"
        label={busy ? "Creating…" : "Create account"}
        disabled={!ok || busy}
        onPress={submit}
      />
    </View>
  );
}

export function AccountScreen() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const acct = useAccount();
  const [mode, setMode] = useState<AccountMode>(
    modeParam === "create" ? "create" : "signIn",
  );
  if (!isEnabled("accounts")) return <Redirect href="/create" />;
  return (
    <Page title="Account">
      {acct.status === "unavailable" ? (
        <Notice title="Account server">{NOT_RUNNING}</Notice>
      ) : null}
      {acct.status === "signedIn" ? (
        <SignedIn onSignOut={acct.signOut} />
      ) : (
        <View style={{ gap: space.xl }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Chip
              label="Sign in"
              selected={mode === "signIn"}
              onPress={() => setMode("signIn")}
            />
            <Chip
              label="Create account"
              selected={mode === "create"}
              onPress={() => setMode("create")}
            />
          </View>
          {mode === "create" ? (
            <CreateForm key="create" register={acct.register} />
          ) : (
            <SignInForm key="signin" signIn={acct.signIn} />
          )}
        </View>
      )}
      <Button
        kind="ghost"
        label="Continue without an account"
        onPress={() => router.replace("/create")}
      />
    </Page>
  );
}
