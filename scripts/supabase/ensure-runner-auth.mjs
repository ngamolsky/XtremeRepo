import { createClient } from "@supabase/supabase-js";
import { parseArgs, resolveSupabaseTarget } from "./target.mjs";

const TEAM_PASSWORD = process.env.XTREME_TEAM_PASSWORD || "XtremeFalcons2024!";
const EMAIL_DOMAIN = "@xtreme-falcons.com";

const args = parseArgs();
const target = await resolveSupabaseTarget(args);

const adminClient = createClient(target.url, target.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const signInClient = createClient(target.url, target.anonKey || target.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: runners, error: runnersError } = await adminClient
  .from("runners")
  .select("id,name,email,auth_user_id")
  .not("email", "is", null)
  .order("name");

if (runnersError) {
  throw runnersError;
}

const runnerAccounts = (runners || []).map((runner) => ({
  ...runner,
  email: normalizeEmail(runner.email),
}));

assertUniqueEmails(runnerAccounts);

const usersByEmail = await listAuthUsersByEmail(adminClient);
const results = [];

for (const runner of runnerAccounts) {
  if (!runner.email.endsWith(EMAIL_DOMAIN)) {
    results.push({
      email: runner.email,
      name: runner.name,
      status: "skipped",
      reason: `email is outside ${EMAIL_DOMAIN}`,
    });
    continue;
  }

  let user = usersByEmail.get(runner.email);
  let status = "updated";

  if (user) {
    const { data, error } = await adminClient.auth.admin.updateUserById(user.id, {
      password: TEAM_PASSWORD,
      user_metadata: { name: runner.name },
    });

    if (error) {
      throw new Error(`Failed updating ${runner.email}: ${error.message}`);
    }

    user = data.user;
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: runner.email,
      password: TEAM_PASSWORD,
      email_confirm: true,
      user_metadata: { name: runner.name },
    });

    if (error) {
      throw new Error(`Failed creating ${runner.email}: ${error.message}`);
    }

    user = data.user;
    usersByEmail.set(runner.email, user);
    status = "created";
  }

  const { error: linkError } = await adminClient
    .from("runners")
    .update({ auth_user_id: user.id, email: runner.email })
    .eq("id", runner.id);

  if (linkError) {
    throw new Error(`Failed linking ${runner.email}: ${linkError.message}`);
  }

  let signIn = "not checked";

  if (args.verify) {
    const { error: signInError } = await signInClient.auth.signInWithPassword({
      email: runner.email,
      password: TEAM_PASSWORD,
    });

    if (signInError) {
      throw new Error(`Sign-in verification failed for ${runner.email}: ${signInError.message}`);
    }

    await signInClient.auth.signOut();
    signIn = "ok";
  }

  results.push({
    email: runner.email,
    name: runner.name,
    status,
    signIn,
  });
}

const skipped = results.filter((result) => result.status === "skipped");
const ensured = results.filter((result) => result.status !== "skipped");

console.log(`Target: ${target.mode} (${target.projectRef})`);
console.log(`Ensured ${ensured.length} runner auth account${ensured.length === 1 ? "" : "s"}.`);

for (const result of ensured) {
  console.log(`- ${result.email}: ${result.status}; sign-in ${result.signIn}`);
}

for (const result of skipped) {
  console.log(`- ${result.email}: skipped (${result.reason})`);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function assertUniqueEmails(runners) {
  const seen = new Map();

  for (const runner of runners) {
    if (seen.has(runner.email)) {
      throw new Error(
        `Duplicate runner email ${runner.email}: ${seen.get(runner.email)} and ${runner.name}`
      );
    }

    seen.set(runner.email, runner.name);
  }
}

async function listAuthUsersByEmail(client) {
  const usersByEmail = new Map();
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    for (const user of data.users || []) {
      if (user.email) {
        usersByEmail.set(normalizeEmail(user.email), user);
      }
    }

    if (!data.users || data.users.length < 1000) {
      break;
    }

    page += 1;
  }

  return usersByEmail;
}
