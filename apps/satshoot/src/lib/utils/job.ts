import { TicketStatus } from '$lib/events/TicketEvent';

export function getJobStatusString(status: TicketStatus) {
    if (status === TicketStatus.New) {
        return 'New';
    }

    if (status === TicketStatus.InProgress) {
        return 'In Progress';
    }

    if (status === TicketStatus.Resolved) {
        return 'Resolved';
    }

    return 'Failed';
}

export function getJobStatusColor(status: TicketStatus) {
    if (status === TicketStatus.New) {
        return 'text-primary-400-500-token';
    }

    if (status === TicketStatus.InProgress) {
        return 'text-success-500';
    }

    if (status === TicketStatus.Resolved) {
        return 'text-tertiary-500';
    }

    return 'text-error-500';
}
