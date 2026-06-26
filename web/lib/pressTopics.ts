// Curated, platform-faithful interview topics for reporters. This is both the
// graceful fallback when the AI key is absent AND the grounding context the AI
// is given — so generated questions never drift from Matt's published platform.
// No invented stats, quotes, or endorsements; the lawsuit is framed as pending.

export type TopicCluster = {
  topic: string;
  angle: string;
  questions: string[];
};

export const PRESS_TOPICS: TopicCluster[] = [
  {
    topic: "Why he's running",
    angle: "Introduce the candidate — a neighbor, a dad, and a problem-solver.",
    questions: [
      "You describe yourself as a neighbor, a dad, and a problem-solver — what made you decide to run for Congress in MO-02 now?",
      "How do 25 years in the courtroom shape the way you'd approach the job?",
      "What's the one thing you most want voters in the district to know about you before August 4?",
    ],
  },
  {
    topic: "Children first & the family courts",
    angle: "His signature issue and the proposed CHILD Protection Act. The related federal lawsuit is pending — handle as allegations, not findings.",
    questions: [
      "Your campaign centers on putting children first — what specifically does that mean in federal policy terms?",
      "Can you walk us through the CHILD Protection Act you've proposed and what it would change?",
      "You've tied federal Title IV-D grant money to courts that stay clean — how would that work in practice?",
      "There's pending litigation about the family court system. Without getting into the case, why is this issue personal for you?",
    ],
  },
  {
    topic: "Term limits",
    angle: "Supports term limits for both chambers, with a grandfather clause.",
    questions: [
      "You back term limits for the House and Senate — why include a grandfather clause?",
      "Would you commit to limiting your own time in office, and to what?",
      "How do you answer critics who say term limits hand more power to staff and lobbyists?",
    ],
  },
  {
    topic: "Smaller government & spending",
    angle: "A leaner federal workforce funded by efficiency; lower taxes by cutting waste first.",
    questions: [
      "You favor a federal hiring freeze and voluntary early retirement — how do you right-size Washington without hurting services?",
      "You've said relief should be funded by cutting waste before changing tax rates — where would you start?",
      "What's a concrete example of the kind of waste or duplication you'd target first?",
    ],
  },
  {
    topic: "The district & the new map",
    angle: "MO-02 under the 2025 enacted map; 'every county, every voice.'",
    questions: [
      "MO-02 changed under the new map — how are you campaigning across both the suburban and rural parts of the district?",
      "What are you hearing most from voters as you travel the district?",
      "How do you plan to represent constituents who didn't vote for you?",
    ],
  },
];
