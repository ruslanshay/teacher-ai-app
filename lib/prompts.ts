import type { Topic, Prompt } from './types';

// Start with NO preset topics; you’ll add your own in the UI.
export const topics: Topic[] = [];

// Global buttons available for any topic
export const prompts: Prompt[] = [
  {
    id: 'btn-lesson-plan',
    label: 'Lesson plan',
    template:
      'Create a concise lesson plan for {{topic}} aligned with {{curriculum}} for grade {{grade}}. Include: Do Now, Introduction, Guided Practice, Independent Practice, Closure, Exit Ticket. If helpful, use information from {{context}}.'
  },
  {
    id: 'btn-myp-task-clarifications',
    label: 'MYP task clarifications',
    template:
      'Write student-friendly task clarifications and success criteria for an MYP task on {{topic}}. Reference relevant command terms and assessment criteria. Use article/notes from {{context}} if provided.'
  },
  {
    id: 'btn-atl-skills',
    label: 'ATL skills',
    template:
      'Suggest specific ATL (Approaches to Learning) skills to target while teaching {{topic}} to grade {{grade}}. Provide practical classroom strategies and quick checks for understanding. Consider any info in {{context}}.'
  },
  {
    id: 'btn-summative-ideas',
    label: 'Summative assessment ideas',
    template:
      'Propose 3–5 summative assessment ideas for {{topic}} aligned to {{curriculum}} and appropriate for grade {{grade}}. Include a short rubric outline and opportunities for differentiation. Use {{context}} where relevant.'
  }
];
