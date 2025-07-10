import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { SmartContractService } from '../../services/smart-contract.service';
import { ToastrService } from 'ngx-toastr';
import { Subscription, take } from 'rxjs';
import { Proposal } from '../../interface/proposal.interface';

@Component({
  selector: 'app-proposals',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './proposals.component.html',
  styleUrl: './proposals.component.css',
})
export class ProposalsComponent implements OnInit, OnDestroy {
  proposals: Proposal[] = [];

  //paginate
  visibleProposals: Proposal[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalPages!: number;

  //search filters
  selectedFilter: string = 'all';
  searchFilter: 'id' | 'title' | 'proposer' = 'id';
  filteredProposals: Proposal[] = [];
  searchText!: string;

  //modal
  voteLoading: boolean = false;
  showVoteModal: boolean = false;
  showAddModal: boolean = false;
  viewMoreProposal!: Proposal;

  //init
  initComponent: boolean = true;
  proposalSubscription!: Subscription;
  minDate!: string;
  maxDate!: string;
  selectedDeadline!: string;
  proposalForm!: FormGroup;

  constructor(
    private smcSrv: SmartContractService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.initForm();
    await this.initDapp();

    this.initComponent = false;
  }

  async initDapp() {
    try {
      if (!this.smcSrv.userAddress) {
        await this.smcSrv.connectWallet();
      }

      await this.smcSrv.getAllProposals();

      this.smcSrv.listenToProposalCreated();
      this.smcSrv.listenToVoteAdded();

      this.proposalSubscription = this.smcSrv.proposals$.subscribe((value) => {
        this.proposals = value;
        this.applyFilter();
      });

      const today = new Date();
      const maxFutureDate = new Date();
      maxFutureDate.setDate(today.getDate() + 30); // 30 days from now
      this.minDate = this.formatDate(today);
      this.maxDate = this.formatDate(maxFutureDate);

      this.paginate();
    } catch (error) {
      console.error('Error initializing DAPP', error);
      this.toastr.error('Error initializing DAPP');
    }
  }

  initForm() {
    this.proposalForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      deadline: ['', Validators.required],
      description: ['', [Validators.required, this.wordCountValidator(1, 100)]],
    });
  }

  paginate() {
    this.totalPages = Math.ceil(
      this.filteredProposals.length / this.itemsPerPage
    );

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;

    const endIndex = startIndex + this.itemsPerPage;

    this.visibleProposals = this.filteredProposals.slice(startIndex, endIndex);
  }

  goToFirstPage() {
    if (this.totalPages === 0) return;
    this.currentPage = 1;
    this.paginate();
  }

  goToLastPage() {
    if (this.totalPages === 0) return;
    this.currentPage = this.totalPages;
    this.paginate();
  }

  goToNextPage() {
    if (this.totalPages === 0) return;
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.paginate();
    }
  }

  goToPreviousPage() {
    if (this.totalPages === 0) return;
    if (this.currentPage > 1) {
      this.currentPage--;
      this.paginate();
    }
  }

  getFilteredProposals(): Proposal[] {
    const date = Math.floor(Date.now() / 1000);

    switch (this.selectedFilter) {
      case 'all':
        return this.proposals;

      case 'voted':
        return this.proposals.filter((p) => p.hasVoted);

      case 'unvoted':
        return this.proposals.filter((p) => !p.hasVoted);

      case 'popular':
        return [...this.proposals].sort(
          (a, b) =>
            b.votesForCount +
            b.votesAgainstCount -
            (a.votesForCount + a.votesAgainstCount)
        );

      case 'open':
        return this.proposals.filter((p) => p.deadline > date);

      case 'approved':
        return this.proposals.filter(
          (p) => p.deadline < date && p.votesForCount > p.votesAgainstCount
        );

      case 'rejected':
        return this.proposals.filter(
          (p) => p.deadline < date && p.votesForCount < p.votesAgainstCount
        );

      default:
        this.toastr.error('Invalid filter type');
        return [];
    }
  }

  applyFilter() {
    this.filteredProposals = this.getFilteredProposals();
    this.currentPage = 1;
    this.paginate();
  }

  applySearch() {
    const query = this.searchText?.toLowerCase().trim() || '';

    let proposals = this.getFilteredProposals();

    if (query) {
      proposals = proposals.filter((proposal) => {
        switch (this.searchFilter) {
          case 'id':
            return proposal.id.toString().includes(query);
          case 'title':
            return proposal.title.toLowerCase().includes(query);
          case 'proposer':
            return proposal.proposer.toLowerCase().includes(query);
          default:
            return true;
        }
      });
    }

    this.filteredProposals = proposals;
    this.currentPage = 1;
    this.paginate();
  }

  async createProposal() {
    if (this.proposalForm.invalid) {
      this.showFormErrors();
      return;
    }

    const { title, deadline, description } = this.proposalForm.value;

    const deadlineDate = new Date(deadline);
    const deadlineTimestamp = Math.floor(deadlineDate.getTime() / 1000);

    await this.smcSrv.createProposal(title, deadlineTimestamp, description);

    this.toggleAddModal();
  }

  async voteProposal(vote: boolean, id: number) {
    this.voteLoading = true;
    await this.smcSrv.voteProposal(vote, id);

    const proposal = this.proposals.find((p) => p.id === id);

    if (!proposal) {
      console.error('Proposal not found');
      return;
    }

    this.smcSrv.voteConfirmed$.pipe(take(1)).subscribe((id) => {
      if (id === proposal.id) {
        if (vote) {
          proposal.hasVoted = 'for';
        } else {
          proposal.hasVoted = 'against';
        }

        this.voteLoading = false;
        this.toastr.success('Vote recorded!');
      }
    });
  }

  toggleVoteModal(id?: number) {
    if (this.showVoteModal) {
      this.showVoteModal = false;
    } else {
      this.viewMoreProposal =
        this.proposals.find((p) => p.id === id) || this.proposals[0];
      this.showVoteModal = true;
    }
  }

  toggleAddModal() {
    this.showAddModal = !this.showAddModal;
  }

  disconnectAccount() {
    this.smcSrv.disconnect();
    this.toastr.success('Account successfully disconnected');
    this.router.navigateByUrl('/');
  }

  ngOnDestroy(): void {
    this.proposalSubscription.unsubscribe();
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // format as 'YYYY-MM-DD'
  }

  setVoteText(vote: string) {
    if (vote === 'for') {
      return 'You have voted in favor of the proposal';
    } else {
      return 'You have voted against the proposal';
    }
  }

  get descriptionWordCount(): number {
    const desc = this.proposalForm.get('description')?.value || '';

    return desc
      .trim()
      .split(/\s+/)
      .filter((word: any) => word.length > 0).length;
  }

  wordCountValidator(min: number, max: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value || '';
      const wordCount = value
        .trim()
        .split(/\s+/)
        .filter((w: any) => w.length > 0).length;

      if (wordCount < min) {
        return { tooFewWords: { required: min, actual: wordCount } };
      }

      if (wordCount > max) {
        return { tooManyWords: { required: max, actual: wordCount } };
      }

      return null;
    };
  }

  showFormErrors() {
    const controls = this.proposalForm.controls;

    for (const name in controls) {
      if (controls[name].errors) {
        const errors = controls[name].errors;

        for (const error in errors) {
          const errorMessage = this.getErrorMessage(name, error, errors[error]);
          this.toastr.error(errorMessage, 'Validation Error');
        }
      }
    }
  }

  getErrorMessage(
    controlName: string,
    errorName: string,
    errorValue: any
  ): string {
    const friendlyName = {
      title: 'Title',
      deadline: 'Deadline',
      description: 'Description',
    }[controlName];

    switch (errorName) {
      case 'required':
        return `${friendlyName} is required.`;

      case 'maxlength':
        return `${friendlyName} cannot be longer than ${errorValue.requiredLength} characters.`;

      case 'minlength':
        return `${friendlyName} must be at least ${errorValue.requiredLength} characters.`;

      case 'tooFewWords':
        return `${friendlyName} must be at least ${errorValue.required} words. You entered ${errorValue.actual}.`;

      case 'tooManyWords':
        return `${friendlyName} must not exceed ${errorValue.required} words. You entered ${errorValue.actual}.`;

      default:
        return `Invalid input in ${friendlyName}.`;
    }
  }

  setStatus(proposal: Proposal) {
    const deadlineDate = new Date();
    const deadlineTimestamp = Math.floor(deadlineDate.getTime() / 1000);

    if (proposal.deadline > deadlineTimestamp) {
      return 'Open';
    } else {
      if (proposal.votesForCount > proposal.votesAgainstCount) {
        return 'Approved';
      } else {
        return 'Rejected';
      }
    }
  }

  formatTimestampToDate(timestamp: number): string {
    const date = new Date(Number(timestamp) * 1000); // convert seconds to milliseconds
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  }
}
