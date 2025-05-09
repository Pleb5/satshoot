<script lang="ts">
    import { toaster } from '$lib/stores/toaster';
    import { getStandardAspectRatio } from '$lib/utils/image';
    import { FileUpload, type FileUploadApi } from '@skeletonlabs/skeleton-svelte';

    interface FileAcceptDetails {
        files: File[];
    }

    interface FileRejectDetails {
        files: FileRejection[];
    }

    interface FileRejection {
        file: File;
        errors: FileError[];
    }

    type AnyString = string & {};
    type FileError =
        | 'TOO_MANY_FILES'
        | 'FILE_INVALID_TYPE'
        | 'FILE_TOO_LARGE'
        | 'FILE_TOO_SMALL'
        | 'FILE_INVALID'
        | 'FILE_EXISTS'
        | AnyString;

    interface Props {
        maxFiles: number;
        subtext: string;
        classes?: string;
        onSelectFiles: (files: File[]) => void;
        validate?: (file: File) => string[] | null;
        onApiReady?: ((api: FileUploadApi) => void) | undefined;
    }

    const { maxFiles, subtext, classes, validate, onSelectFiles, onApiReady }: Props = $props();

    let fileUploadApi: FileUploadApi;

    let processingFiles = false;

    async function handleFileAccept({ files }: FileAcceptDetails) {
        if (processingFiles) return;

        processingFiles = true;

        const validImages: File[] = [];

        for (const file of files) {
            const aspectRatio = await getStandardAspectRatio(file);
            console.log('file.name, aspectRatio', file.name, aspectRatio);
            if (aspectRatio === '16:9') {
                validImages.push(file);
            } else {
                toaster.error({
                    title: `Image ${file.name} does not match required aspect ratio (16:9)`,
                });

                fileUploadApi.deleteFile(file);
            }
        }

        onSelectFiles(validImages);

        processingFiles = false;
    }

    // Handle file rejection
    function handleFileReject({ files }: FileRejectDetails) {
        files.forEach((obj) => {
            toaster.error({
                title: `${obj.file.name}: ${obj.errors.join(',')}`,
            });
        });
    }

    const interfaceClasses =
        'flex flex-col items-center gap-2 hover:cursor-pointer hover:preset-tonal ' +
        'border-[1px] border-dashed border-surface-200-800 p-4 py-10 rounded-container';
</script>

<!-- File Upload -->
<FileUpload
    name="images"
    accept="image/*"
    {maxFiles}
    {subtext}
    {classes}
    {validate}
    onFileAccept={handleFileAccept}
    onFileReject={handleFileReject}
    onApiReady={(_api) => {
        fileUploadApi = _api;
        if (onApiReady) onApiReady(_api);
    }}
>
    {#snippet iconInterface()}<i class="bx bx-image-add"></i>{/snippet}
    <div class={interfaceClasses} data-testid="uploader-interface">
        <span data-testid="uploader-interface-icon">
            <i class="bx bx-image-add"></i>
        </span>
        <small class="text-xs opacity-60" data-testid="uploader-interface-subtext">
            {subtext}
        </small>
    </div>
</FileUpload>
