import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';

export type MediaItem = {
    id: string;
    type: 'url' | 'file';
    value: string | File;
    preview?: string;
};

export const useProductImages = (initialImages: string[] = []) => {
    const [mediaItems, setMediaItems] = useState<MediaItem[]>(
        initialImages.map(url => ({
            id: Math.random().toString(36).substr(2, 9),
            type: 'url',
            value: url,
        }))
    );
    const [isDragging, setIsDragging] = useState(false);
    const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const processFiles = useCallback((files: FileList) => {
        if (mediaItems.length + files.length > 4) {
            toast.error('Máximo de 4 imagens por produto');
            return;
        }
        const newItems: MediaItem[] = Array.from(files).map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            type: 'file',
            value: file,
            preview: URL.createObjectURL(file),
        }));
        setMediaItems(prev => [...prev, ...newItems]);
    }, [mediaItems.length]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processFiles(e.target.files);
    }, [processFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);
    const handleDragLeave = useCallback(() => setIsDragging(false), []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
    }, [processFiles]);

    const removeMedia = useCallback((idToRemove: string) => {
        const item = mediaItems.find(i => i.id === idToRemove);
        if (item && item.type === 'url') {
            setImagesToDelete(prev => [...prev, item.value as string]);
        }
        setMediaItems(items => items.filter(i => i.id !== idToRemove));
        setCurrentImageIndex(prev =>
            prev >= mediaItems.length - 1 ? Math.max(0, mediaItems.length - 2) : prev
        );
    }, [mediaItems]);

    const setMainMedia = useCallback((index: number) => {
        if (index === 0) return;
        setMediaItems(items => {
            const newItems = [...items];
            const [moved] = newItems.splice(index, 1);
            newItems.unshift(moved);
            return newItems;
        });
        setCurrentImageIndex(0);
    }, []);

    const nextImage = useCallback(() => {
        if (mediaItems.length > 1) {
            setCurrentImageIndex(prev => (prev + 1) % mediaItems.length);
        }
    }, [mediaItems.length]);
    const prevImage = useCallback(() => {
        if (mediaItems.length > 1) {
            setCurrentImageIndex(prev => (prev - 1 + mediaItems.length) % mediaItems.length);
        }
    }, [mediaItems.length]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = mediaItems.findIndex((item) => item.id === active.id);
        const newIndex = mediaItems.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(mediaItems, oldIndex, newIndex);
        setMediaItems(newItems);

        // Ajusta currentImageIndex
        setCurrentImageIndex(prev => {
            if (prev === oldIndex) return newIndex;
            if (prev > oldIndex && prev <= newIndex) return prev - 1;
            if (prev < oldIndex && prev >= newIndex) return prev + 1;
            return prev;
        });
    }, [mediaItems]);

    const moveUp = useCallback((index: number) => {
        if (index === 0) return;
        const newItems = arrayMove(mediaItems, index, index - 1);
        setMediaItems(newItems);
        setCurrentImageIndex(prev => {
            if (prev === index) return index - 1;
            if (prev === index - 1) return index;
            return prev;
        });
    }, [mediaItems]);

    const moveDown = useCallback((index: number) => {
        if (index === mediaItems.length - 1) return;
        const newItems = arrayMove(mediaItems, index, index + 1);
        setMediaItems(newItems);
        setCurrentImageIndex(prev => {
            if (prev === index) return index + 1;
            if (prev === index + 1) return index;
            return prev;
        });
    }, [mediaItems]);

    const resetImages = useCallback(() => {
        setMediaItems([]);
        setImagesToDelete([]);
        setCurrentImageIndex(0);
    }, []);

    return {
        mediaItems,
        isDragging,
        imagesToDelete,
        currentImageIndex,
        hasMultipleImages: mediaItems.length > 1,
        processFiles,
        handleFileSelect,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        removeMedia,
        setMainMedia,
        nextImage,
        prevImage,
        handleDragEnd,
        moveUp,
        moveDown,
        resetImages,
        setMediaItems,
        setImagesToDelete,
        setCurrentImageIndex,
    };
};