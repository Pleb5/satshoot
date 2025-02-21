import currentUser from '$lib/stores/user';
import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';

export const load = () => {
  const $currentUser  = get(currentUser)
  // if(!$currentUser)   throw redirect(302, '/');

  throw redirect(302, '/settings/general');
};