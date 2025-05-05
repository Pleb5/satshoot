import { JobStatus } from '$lib/events/JobEvent';

export function getJobStatusString(status: JobStatus) {
    if (status === JobStatus.New) {
        return 'New';
    }

    if (status === JobStatus.InProgress) {
        return 'In Progress';
    }

    if (status === JobStatus.Resolved) {
        return 'Resolved';
    }

    return 'Failed';
}

export function getJobStatusColor(status: JobStatus) {
    if (status === JobStatus.New) {
        return 'text-primary-400-500';
    }

    if (status === JobStatus.InProgress) {
        return 'text-success-500';
    }

    if (status === JobStatus.Resolved) {
        return 'text-tertiary-500';
    }

    return 'text-error-500';
}
