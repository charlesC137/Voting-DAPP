import { Injectable } from '@angular/core';
import DAO from '../../assets/abi/DAO.json';
import { BrowserProvider, ethers } from 'ethers';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, Subject } from 'rxjs';
import { Proposal } from '../interface/proposal.interface';

declare let window: any;

@Injectable({
  providedIn: 'root',
})
export class SmartContractService {
  private contractAddress = '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE';
  private abi = DAO.abi;
  private provider!: ethers.BrowserProvider | null;
  private signer!: ethers.JsonRpcSigner | null;
  private contract!: ethers.Contract | null;

  public proposals$ = new BehaviorSubject<Proposal[]>([]);
  public voteConfirmed$ = new Subject<number>();
  public userAddress!: string;

  constructor(private toastr: ToastrService, private router: Router) {}

  async connectWallet(): Promise<void> {
    try {
      if (!window.ethereum) {
        this.toastr.error('Please install MetaMask!');
        return;
      }

      this.provider = new BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();

      const address = await this.signer.getAddress();
      this.userAddress = address;
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.abi,
        this.signer
      );

      this.toastr.success(`Connected wallet: ${address}`);
      this.router.navigateByUrl('/proposals');
    } catch (error) {
      this.toastr.error('Wallet connection failed');
      console.error('Wallet connection failed:', error);
      this.router.navigateByUrl('/');
    }
  }

  async getAllProposals(): Promise<any> {
    try {
      if (!this.contract) {
        this.toastr.error('Error connecting to contract');
        throw new Error('Contract not initialized');
      }

      const proposals: Proposal[] = await this.contract['getAllProposals']();

      this.updateProposals(proposals, true);
    } catch (err: any) {
      this.toastr.error('Error fetching proposals');
      console.error(
        'Error fetching proposals:',
        err?.reason || err?.message || err
      );
      return [];
    }
  }

  async createProposal(
    title: string,
    deadline: number,
    description: string
  ): Promise<any> {
    try {
      if (!this.contract) {
        this.toastr.error('Error connecting to contract');
        throw new Error('Contract not initialized');
      }

      const tx = await this.contract['createProposal'](
        title,
        deadline,
        description
      );

      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        this.toastr.error('Error creating proposal');
        console.error('Transaction reverted.');
        return;
      }
    } catch (err: any) {
      this.toastr.error('Error creating proposal');
      console.error(
        'Error creating proposal:',
        err?.reason || err?.message || err
      );
    }
  }

  async voteProposal(vote: boolean, proposalId: number): Promise<any> {
    try {
      if (!this.contract) {
        this.toastr.error('Error connecting to contract');
        throw new Error('Contract not initialized');
      }

      const tx = await this.contract['vote'](vote, proposalId);

      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        this.toastr.error('Error voting on proposal');
        console.error('Transaction reverted.');
        return;
      }
    } catch (err: any) {
      this.toastr.error('Error voting on proposal');
      console.error(
        'Error voting on proposal',
        err?.reason || err?.message || err
      );
    }
  }

  private updateProposals(proposals: Proposal[], format?: boolean) {
    if (format) {
      proposals = proposals.map((p: Proposal) => ({
        id: Number(p.id),
        title: p.title,
        proposer: p.proposer,
        deadline: Number(p.deadline),
        votesForCount: Number(p.votesForCount),
        votesAgainstCount: Number(p.votesAgainstCount),
        description: p.description,
        hasVoted: p.hasVoted,
      }));

      proposals.reverse();
    }
    this.proposals$.next(proposals);
  }

  private getCurrentLocalProposals() {
    return this.proposals$.getValue();
  }

  listenToProposalCreated() {
    try {
      if (!this.contract) {
        this.toastr.error('Error connecting to contract');
        console.log('Contract not initialized');
        return;
      }

      this.contract.on(
        'ProposalCreated',
        (
          id,
          title,
          proposer,
          deadline,
          votesForCount,
          votesAgainstCount,
          description,
          hasVoted
        ) => {
          const newProposal: Proposal = {
            id: Number(id),
            title,
            proposer,
            deadline,
            votesForCount: Number(votesForCount),
            votesAgainstCount: Number(votesAgainstCount),
            description,
            hasVoted,
          };

          const proposalExists = this.getCurrentLocalProposals().find(
            (p) => p.id === newProposal.id
          );

          if (proposalExists) {
            return;
          }

          this.updateProposals([
            newProposal,
            ...this.getCurrentLocalProposals(),
          ]);
        }
      );
    } catch (error) {
      console.error('Error handling new proposal event', error);
      this.toastr.error(
        'An error has occured. Please refresh or try again later'
      );
    }
  }

  listenToVoteAdded() {
    try {
      if (!this.contract) {
        this.toastr.error('Error connecting to contract');
        console.log('Contract not initialized');
        return;
      }

      this.contract.on('VoteAdded', (id, votesForCount, votesAgainstCount) => {
        const proposal = this.getCurrentLocalProposals().find(
          (p) => p.id === Number(id)
        );

        if (!proposal) {
          console.error('Error handling vote added event');
          return;
        }

        proposal.votesForCount = votesForCount;
        proposal.votesAgainstCount = votesAgainstCount;

        this.voteConfirmed$.next(Number(id));
      });
    } catch (error) {
      console.error('Error handling vote added event');
      this.toastr.error(
        'An error has occured. Please refresh or try again later'
      );
    }
  }

  disconnect() {
    this.userAddress = '';
    this.contract = null;
    this.signer = null;
  }
}
