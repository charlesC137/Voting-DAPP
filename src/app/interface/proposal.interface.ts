export interface Proposal {
  id: number;
  title: string;
  proposer: string;
  deadline: number;
  votesForCount: number;
  votesAgainstCount: number;
  description: string;
  hasVoted: false | 'for' | 'against';
}
