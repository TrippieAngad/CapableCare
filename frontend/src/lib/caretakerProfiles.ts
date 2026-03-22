export type CareRecipientTaskSummary = {
  id: string;
  title: string;
  priority: "Low" | "Medium" | "High";
  status: "On Track" | "Needs Follow-up" | "Today" | "Upcoming";
};

export type CareRecipientScheduleItem = {
  id: string;
  title: string;
  when: string;
  detail: string;
};

export type CareRecipientMessage = {
  id: string;
  author: string;
  content: string;
  time: string;
  incoming: boolean;
};

export type CareRecipientUpdate = {
  id: string;
  title: string;
  status: "Good" | "Needs Attention" | "Urgent";
  detail: string;
  time: string;
};

export type CareRecipientStaticProfile = {
  id: string;
  name: string;
  age: number;
  address: string;
  statusLabel: string;
  statusTone: "tone-good" | "tone-watch" | "tone-alert";
  summary: string;
  highlights: string[];
  tasks: CareRecipientTaskSummary[];
  schedule: CareRecipientScheduleItem[];
  careGoals: string[];
  routines: string[];
  restrictions: string[];
  emergencyContact: {
    name: string;
    phone: string;
  };
  updates: CareRecipientUpdate[];
  messages: CareRecipientMessage[];
};

export const demoCareRecipients: CareRecipientStaticProfile[] = [
  {
    id: "demo-helen",
    name: "Helen Carter",
    age: 79,
    address: "Willow Creek Apartments, Unit 14",
    statusLabel: "Watch",
    statusTone: "tone-watch",
    summary:
      "Mobility is a bit slower this week. Medication is on track and appetite is steady.",
    highlights: [
      "Uses walker for all room-to-room movement",
      "Needs blood pressure logged after lunch",
      "Daughter wants evening update after Thursday visit",
    ],
    tasks: [
      {
        id: "helen-task-1",
        title: "Check lunch medication organizer",
        priority: "High",
        status: "Today",
      },
      {
        id: "helen-task-2",
        title: "Confirm PT ride for Tuesday",
        priority: "Medium",
        status: "Needs Follow-up",
      },
      {
        id: "helen-task-3",
        title: "Restock electrolyte drinks",
        priority: "Low",
        status: "Upcoming",
      },
    ],
    schedule: [
      {
        id: "helen-schedule-1",
        title: "Lunch medication reminder",
        when: "Today, 12:30 PM",
        detail: "Take with food and log blood pressure.",
      },
      {
        id: "helen-schedule-2",
        title: "Physical therapy",
        when: "Tuesday, 10:00 AM",
        detail: "Transportation pickup confirmed for 9:20 AM.",
      },
      {
        id: "helen-schedule-3",
        title: "Family call",
        when: "Thursday, 6:00 PM",
        detail: "Share mobility update with Nina.",
      },
    ],
    careGoals: [
      "Keep transfers safe and supervised",
      "Maintain hydration and stable blood pressure readings",
      "Preserve confidence with short indoor walks",
    ],
    routines: [
      "Morning stretching after breakfast",
      "Blood pressure reading after lunch",
      "Evening walker check before bed",
    ],
    restrictions: [
      "No stairs without family present",
      "Avoid carrying laundry basket while walking",
      "Needs reminder before standing from recliner",
    ],
    emergencyContact: {
      name: "Nina Carter",
      phone: "(804) 555-0141",
    },
    updates: [
      {
        id: "helen-update-1",
        title: "Afternoon visit completed",
        status: "Needs Attention",
        detail:
          "Reported light dizziness when standing quickly; resolved after water and seated rest.",
        time: "Today, 2:15 PM",
      },
      {
        id: "helen-update-2",
        title: "Medication check",
        status: "Good",
        detail: "No missed doses recorded in the organizer this week.",
        time: "Yesterday, 1:05 PM",
      },
    ],
    messages: [
      {
        id: "helen-message-1",
        author: "Nina Carter",
        content: "Please text me if PT transport timing changes.",
        time: "Today, 8:12 AM",
        incoming: true,
      },
      {
        id: "helen-message-2",
        author: "You",
        content: "I’ll confirm the driver window after lunch meds are done.",
        time: "Today, 8:18 AM",
        incoming: false,
      },
    ],
  },
  {
    id: "demo-joseph",
    name: "Joseph Ramirez",
    age: 84,
    address: "Maple Terrace Senior Living, Room 203",
    statusLabel: "Stable",
    statusTone: "tone-good",
    summary:
      "Routine week overall. Meals are consistent and social engagement is up after group activities.",
    highlights: [
      "Hard of hearing on left side; speak from the right",
      "Prefers breakfast before medications",
      "Son wants note if sleep becomes restless again",
    ],
    tasks: [
      {
        id: "joseph-task-1",
        title: "Replace hearing aid batteries",
        priority: "Medium",
        status: "Today",
      },
      {
        id: "joseph-task-2",
        title: "Review glucose log with nurse",
        priority: "High",
        status: "Upcoming",
      },
      {
        id: "joseph-task-3",
        title: "Bring cardigan back from laundry",
        priority: "Low",
        status: "On Track",
      },
    ],
    schedule: [
      {
        id: "joseph-schedule-1",
        title: "Morning wellness check",
        when: "Today, 9:00 AM",
        detail: "Review glucose log before nurse rounds.",
      },
      {
        id: "joseph-schedule-2",
        title: "Card game social hour",
        when: "Wednesday, 3:00 PM",
        detail: "Good opportunity for engagement and mood check.",
      },
      {
        id: "joseph-schedule-3",
        title: "Nurse follow-up",
        when: "Friday, 11:30 AM",
        detail: "Discuss overnight sleep pattern and glucose trends.",
      },
    ],
    careGoals: [
      "Keep glucose readings documented clearly",
      "Support hearing aid use during conversations",
      "Encourage daily social interaction",
    ],
    routines: [
      "Medication after breakfast only",
      "Midday hallway walk",
      "Evening sleep check-in at 8:30 PM",
    ],
    restrictions: [
      "No sugary snacks outside meal plan",
      "Avoid late caffeine",
      "Needs hearing aid battery check every other day",
    ],
    emergencyContact: {
      name: "Luis Ramirez",
      phone: "(804) 555-0178",
    },
    updates: [
      {
        id: "joseph-update-1",
        title: "Morning check-in",
        status: "Good",
        detail: "Glucose log filled out and breakfast completed before meds.",
        time: "Today, 9:22 AM",
      },
      {
        id: "joseph-update-2",
        title: "Evening note",
        status: "Good",
        detail: "Slept through the night with no agitation reported.",
        time: "Yesterday, 8:45 PM",
      },
    ],
    messages: [
      {
        id: "joseph-message-1",
        author: "Luis Ramirez",
        content: "Please mention if he skips the card game this week.",
        time: "Yesterday, 7:10 PM",
        incoming: true,
      },
      {
        id: "joseph-message-2",
        author: "You",
        content: "Will do. He sounded interested in going again tomorrow.",
        time: "Yesterday, 7:16 PM",
        incoming: false,
      },
    ],
  },
];
