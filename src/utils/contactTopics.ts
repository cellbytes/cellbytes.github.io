/**
 * The draft message each entry point into the contact form leaves in the box,
 * keyed by the `topic` its link carries.
 *
 * A visitor arrives with a question already shaped by the page that sent them,
 * so a draft of it is less to write than an empty box, and it says which page
 * made the case before they type anything. Every draft is a message that can be
 * sent exactly as it stands: it states what the visitor wants and proposes a
 * meeting, leaving the specifics to whoever wants to add them. Asking us to
 * send information instead would suggest the pages they just read left
 * something out, and it ends the exchange where a meeting opens one. The
 * privacy draft is the exception, since a question about personal data wants a
 * written answer rather than a call. Nothing here asks for name, role or
 * institution, which the form collects in fields of its own.
 *
 * A draft is a function of the whole query because some of them name what the
 * visitor was looking at when they clicked, which travels alongside the topic.
 * The research drafts name the rate the cards were showing, and the Core one
 * also names the volume. Both are choices made on the page rather than
 * properties of the link, so the links are rewritten as the choices change.
 *
 * The drafts are written as joined fragments so a line of one stays readable
 * here; each is a single line of prose by the time it reaches the box.
 *
 * The navbar button deliberately has no topic: it is on every page, so there is
 * no context to draw on.
 */
export const CONTACT_TOPICS = {
  scanner: () =>
    "We would like to confirm that Cellbytes works with our imaging system " +
    "before we take this further. Could we arrange a call to go through our " +
    "scanner setup and image formats?",

  morphology: () =>
    "We are interested in digitizing our cell morphology analysis and would " +
    "like to understand what moving to Cellbytes would involve. Could we " +
    "arrange a meeting to talk through our workflow and sample volumes?",

  application: () =>
    "We would like to see how the Cellbytes application would fit the way our " +
    "laboratory works today. Could we arrange a meeting to go through it " +
    "together?",

  publications: () =>
    "We are interested in using quantitative cell morphometry in our research " +
    "and would like to explore whether Cellbytes fits our study. Could we " +
    "arrange a meeting to discuss it?",

  news: () =>
    "I came across Cellbytes through your news page and would like to explore " +
    "what it could do for us. Could we arrange a meeting to discuss it?",

  "research-light": (params: URLSearchParams) =>
    "We would like to order the Light research package, for up to 100 slides" +
    rateClause(params) +
    ". Could we arrange a meeting to go through the details and get started?",

  "research-core": (params: URLSearchParams) =>
    "We would like to order the Core research package" +
    volumeClause(params) +
    rateClause(params) +
    ". Could we arrange a meeting to go through the details and get started?",

  "research-advanced": (params: URLSearchParams) =>
    "We would like to order the Advanced research package for a larger cohort" +
    rateClause(params) +
    ". Could we arrange a meeting to go through the details and get started?",

  "research-custom": (params: URLSearchParams) =>
    "None of the listed research packages quite fits what we need, so we " +
    "would like to discuss a custom offer" +
    rateClause(params) +
    ". Could we arrange a meeting to go through our project?",

  "clinical-integration": () =>
    "We would like to know how Cellbytes would integrate with our existing " +
    "systems, and what the integration work would involve on our side. Could " +
    "we arrange a meeting to talk it through?",

  "clinical-offer": () =>
    "We would like an offer for clinical use of Cellbytes. Could we arrange a " +
    "meeting to go through our sample volumes and integration needs?",

  trial: () =>
    "We would like to evaluate Cellbytes in our own laboratory and request " +
    "trial access. Could we arrange a meeting to get set up?",

  privacy: () =>
    "I have a question about how Cellbytes handles personal data and about " +
    "the rights I can exercise over it. Could you get back to me?",
} satisfies Record<string, (params: URLSearchParams) => string>;

export type ContactTopic = keyof typeof CONTACT_TOPICS;

/**
 * The chosen slide count as a sentence fragment, or nothing when the link
 * carries no usable one. A hand-typed or retired URL then still reads as a
 * whole sentence rather than naming a volume nobody picked.
 */
const volumeClause = (params: URLSearchParams) => {
  const slides = params.get("slides");
  return slides && /^[1-9][0-9]*$/.test(slides)
    ? `, for up to ${slides} slides`
    : "";
};

/**
 * Which of the two audiences the cards were pricing for, as a sentence
 * fragment. The page names them "academic" and "industrial"; anything else is
 * left unsaid rather than guessed at.
 */
const rateClause = (params: URLSearchParams) => {
  switch (params.get("audience")) {
    case "academic":
      return ", for academic use";
    case "industrial":
      return ", for industrial use";
    default:
      return "";
  }
};

/**
 * Link to the contact form with `topic`'s draft message already in the box.
 * Anything in `params` travels with the topic for the draft to read back.
 */
export const contactHref = (
  topic: ContactTopic,
  params: Record<string, string | number> = {},
) => {
  const query = new URLSearchParams({ topic });
  for (const [key, value] of Object.entries(params)) {
    query.set(key, String(value));
  }
  return `/contact?${query}`;
};

/** The draft a query asks for, or null when it names no topic we know. */
export const contactMessage = (params: URLSearchParams) => {
  const topic = params.get("topic");
  return topic && topic in CONTACT_TOPICS
    ? CONTACT_TOPICS[topic as ContactTopic](params)
    : null;
};
