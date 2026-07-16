import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  type Interaction,
  type TextChannel,
} from "discord.js";
import {
  approveAvatarSubmission,
  attachDiscordReviewMessage,
  getAvatarSubmission,
  listPendingAvatarSubmissions,
  rejectAvatarSubmission,
} from "../services/submissions.service";
import type { AvatarSubmission } from "../types/ws";
import { resdbToHttpUrl } from "../utils/resonite";

const APPROVE_PREFIX = "avinite:approve:";
const REJECT_PREFIX = "avinite:reject:";

function buildReviewEmbed(submission: AvatarSubmission, status = "pending") {
  const thumbnailUrl = resdbToHttpUrl(submission.thumbnailUri);

  return new EmbedBuilder()
    .setTitle("Avinite Submission")
    .setColor(
      status === "approved"
        ? 0x2ecc71
        : status === "rejected"
          ? 0xe74c3c
          : 0xf1c40f,
    )
    .setThumbnail(thumbnailUrl ?? null)
    .addFields(
      { name: "Name", value: submission.name },
      { name: "Author", value: submission.author },
      { name: "Source URI", value: submission.sourceUri },
      { name: "Record URI", value: submission.recordUri },
      { name: "Description", value: submission.description || "(none)" },
      {
        name: "Tags",
        value:
          submission.tags.length > 0 ? submission.tags.join(", ") : "(none)",
      },
      { name: "Status", value: status },
    );
}

function buildReviewRow(submissionId: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${APPROVE_PREFIX}${submissionId}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${REJECT_PREFIX}${submissionId}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

async function postSubmissionReview(
  channel: TextChannel,
  submission: AvatarSubmission,
) {
  if (submission.discordMessageId) {
    return;
  }

  const message = await channel.send({
    embeds: [buildReviewEmbed(submission)],
    components: [buildReviewRow(submission.id)],
  });

  await attachDiscordReviewMessage(submission.id, channel.id, message.id);
}

async function handleReviewDecision(
  interaction: Interaction,
  submissionId: string,
  decision: "approved" | "rejected",
) {
  if (!interaction.isButton()) {
    return;
  }

  const submission = await getAvatarSubmission(submissionId);
  if (!submission) {
    await interaction.reply({
      content: "Submission not found.",
      ephemeral: true,
    });
    return;
  }

  if (submission.status !== "pending") {
    await interaction.reply({
      content: `Submission is already ${submission.status}.`,
      ephemeral: true,
    });
    return;
  }

  if (decision === "approved") {
    await approveAvatarSubmission(submissionId, interaction.user.id);
  } else {
    await rejectAvatarSubmission(submissionId, interaction.user.id);
  }

  await interaction.update({
    embeds: [buildReviewEmbed(submission, decision)],
    components: [buildReviewRow(submissionId, true)],
  });
}

class DiscordReviewBot {
  private client: Client | null = null;
  private started = false;

  async start() {
    if (this.started) {
      return;
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_REVIEW_CHANNEL_ID;

    if (!token || !channelId) {
      console.warn(
        "How tf do u forget to set DISCORD_BOT_TOKEN and DISCORD_REVIEW_CHANNEL_ID lmao",
      );
      return;
    }

    this.started = true;
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });

    this.client.once(Events.ClientReady, async () => {
      console.log(`Logged in as ${this.client?.user?.tag}`);

      const channel = await this.client?.channels.fetch(channelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        console.warn("Discord review channel is not a text channel.");
        return;
      }

      const pending = await listPendingAvatarSubmissions();
      for (const submission of pending) {
        await postSubmissionReview(channel, submission);
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) {
        return;
      }

      if (interaction.customId.startsWith(APPROVE_PREFIX)) {
        await handleReviewDecision(
          interaction,
          interaction.customId.slice(APPROVE_PREFIX.length),
          "approved",
        );
        return;
      }

      if (interaction.customId.startsWith(REJECT_PREFIX)) {
        await handleReviewDecision(
          interaction,
          interaction.customId.slice(REJECT_PREFIX.length),
          "rejected",
        );
      }
    });

    try {
      await this.client.login(token);
    } catch (error) {
      this.started = false;
      this.client = null;
      console.error("Discord review bot failed to start:", error);
    }
  }

  async queue(submission: AvatarSubmission) {
    if (!this.client?.isReady()) {
      return;
    }

    const channelId = process.env.DISCORD_REVIEW_CHANNEL_ID;
    if (!channelId) {
      return;
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return;
    }

    await postSubmissionReview(channel, submission);
  }
}

export const discordReviewBot = new DiscordReviewBot();
