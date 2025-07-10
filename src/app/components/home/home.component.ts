import { Component } from '@angular/core';
import { CarouselModule } from 'ngx-owl-carousel-o';
import { CommonModule } from '@angular/common';
import { SmartContractService } from '../../services/smart-contract.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CarouselModule, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  constructor(private smcSrv: SmartContractService) {}

  async connectWallet() {
    await this.smcSrv.connectWallet();
  }

  features = [
    {
      icon: 'fas fa-plus-circle',
      title: 'Create Proposals',
      description: 'Suggest new ideas and changes to the community.',
    },
    {
      icon: 'fas fa-vote-yea',
      title: 'Vote on Decisions',
      description: 'Participate in shaping the direction of the DAO.',
    },
    {
      icon: 'fas fa-wallet',
      title: 'Connect Wallet',
      description: 'Securely interact with the DAO using MetaMask.',
    },
    {
      icon: 'fas fa-list-ul',
      title: 'View History',
      description: 'See past proposals and how the community voted.',
    },
    {
      icon: 'fas fa-bell',
      title: 'Real-Time Updates',
      description: 'Get notified when votes are cast or actions taken.',
    },
    {
      icon: 'fas fa-lock',
      title: 'Smart Contract Security',
      description: 'Trust the immutable logic on the blockchain.',
    },
  ];

  customOptions = {
    loop: true,
    margin: 15,
    dots: true,
    autoplay: true,
    autoplayTimeout: 3000,
    autoplayHoverPause: true,
    autoHeight: true,
    responsive: {
      0: {
        items: 1,
      },
      600: {
        items: 2,
      },
      1000: {
        items: 3,
      },
    },
  };
}
