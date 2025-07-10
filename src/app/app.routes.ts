import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { ProposalsComponent } from './components/proposals/proposals.component';

export const routes: Routes = [
  { path: 'proposals', component: ProposalsComponent },
  { path: '', component: HomeComponent },

  //set paths above
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
