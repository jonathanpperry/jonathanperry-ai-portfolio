import {getCliClient} from "sanity/cli";

const client = getCliClient({
  apiVersion: "2025-10-25",
}).withConfig({
  dataset: "develop",
});

const apply = process.argv.includes("--apply");

const cleanup = [
  // Ripple Fiber:
  // Keep factual employment metadata + existing sales description.
  {
    id: "exp-1",
    unset: ["achievements", "responsibilities", "technologies"],
  },

  // Give and Take:
  // Keep factual employment metadata + detailed real description.
  {
    id: "exp-2",
    unset: ["achievements", "responsibilities", "technologies"],
  },

  // Japan:
  // Keep detailed employer/project description for now.
  {
    id: "exp-3",
    unset: ["achievements", "responsibilities", "technologies"],
  },

  // Northrop:
  // Preserve employment metadata, strip template narrative.
  {
    id: "exp-4",
    unset: [
      "description",
      "achievements",
      "responsibilities",
      "technologies",
    ],
  },

  // Harris:
  // Preserve employment metadata, strip template narrative.
  {
    id: "exp-5",
    unset: [
      "description",
      "achievements",
      "responsibilities",
      "technologies",
    ],
  },
];

async function run() {
  const config = client.config();

  console.log(`Project: ${config.projectId}`);
  console.log(`Dataset: ${config.dataset}`);
  console.log(`Authenticated token present: ${Boolean(config.token)}`);
  
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  if (config.dataset !== "develop") {
    throw new Error(
      `Refusing to run against dataset "${config.dataset}". Expected "develop".`,
    );
  }

  const transaction = client.transaction();

  for (const item of cleanup) {
    transaction.patch(item.id, (patch) => patch.unset(item.unset));

    console.log(
      `${apply ? "Removing" : "Would remove"} from ${item.id}: ${item.unset.join(", ")}`,
    );
  }

  const result = await transaction.commit({
    dryRun: !apply,
    visibility: "sync",
  });

  console.log(
    apply
      ? "\nCleanup completed."
      : "\nDry run completed. No Sanity documents were changed.",
  );

  console.log(result);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});