import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', width, height, circle }) => {
    return (
        <div
            className={`animate-pulse bg-gray-200 rounded ${circle ? 'rounded-full' : ''} ${className}`}
            style={{
                width: width !== undefined ? width : undefined,
                height: height !== undefined ? height : undefined,
            }}
        />
    );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
    return (
        <div className="w-full space-y-4">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex space-x-4 items-center">
                    <Skeleton height={20} className="flex-1" />
                    <Skeleton height={20} className="w-20" />
                    <Skeleton height={20} className="w-24" />
                </div>
            ))}
        </div>
    );
};

export const CardSkeleton: React.FC = () => {
    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
                <Skeleton circle width={40} height={40} />
                <div className="space-y-2 flex-1">
                    <Skeleton height={16} width="60%" />
                    <Skeleton height={12} width="40%" />
                </div>
            </div>
            <Skeleton height={60} className="w-full" />
        </div>
    );
};

export const GridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
};

export const StudentDashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className="w-full max-w-md bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col p-4 md:p-6">

                {/* Rematrícula Banner + Actions */}
                <div className="flex gap-3 mb-4">
                    <Skeleton className="flex-1 h-24 rounded-xl" />
                    <div className="flex flex-col items-end gap-2">
                        <Skeleton circle width={40} height={40} />
                        <Skeleton width={60} height={32} className="rounded" />
                    </div>
                </div>

                {/* Student Info Card */}
                <div className="bg-blue-50/50 py-3 px-4 rounded-lg border border-blue-100 mb-4">
                    <div className="flex justify-between items-center">
                        <div className="space-y-2">
                            <Skeleton width={60} height={10} />
                            <Skeleton width={120} height={16} />
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                            <Skeleton width={80} height={10} />
                            <Skeleton width={100} height={16} />
                        </div>
                    </div>
                </div>

                {/* Branding Block - Matching new Spacing */}
                <div className="flex items-center gap-2 mt-12 mb-14">
                    <Skeleton width={36} height={36} />
                    <div className="space-y-1">
                        <Skeleton width={60} height={10} />
                        <Skeleton width={140} height={20} />
                    </div>
                </div>

                {/* Select Option Text */}
                <div className="pb-4">
                    <Skeleton width={180} height={14} />
                </div>

                {/* Grid Buttons */}
                <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} height={120} className="rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
};

export const TeacherDashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className="w-full max-w-md bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col p-4 md:p-6">

                {/* Header Actions (Notifications + Sair) */}
                <div className="flex justify-end mb-6 gap-2">
                    <Skeleton circle width={40} height={40} />
                    <Skeleton width={60} height={32} className="rounded" />
                </div>

                {/* Branding Block */}
                <div className="flex items-center gap-2 mb-4">
                    <Skeleton width={36} height={36} />
                    <div className="space-y-1">
                        <Skeleton width={60} height={10} />
                        <Skeleton width={140} height={20} />
                    </div>
                </div>

                {/* Intro Text */}
                <div className="pb-4">
                    <Skeleton width={200} height={14} />
                </div>

                {/* Grid Buttons */}
                <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} height={140} className="rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
};

export const AdminDashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex font-sans">
            {/* Sidebar Skeleton - Hidden on mobile, fixed on desktop */}
            <div className="hidden lg:flex flex-col w-64 border-r border-gray-200 bg-white h-screen sticky top-0 shrink-0">
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <Skeleton height={24} width={140} />
                </div>
                <div className="p-4 space-y-2 flex-1 overflow-y-auto">
                    {/* Menu Groups */}
                    <div className="space-y-1">
                        <Skeleton height={12} width={80} className="mb-2 ml-2 bg-gray-100" />
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} height={40} className="rounded-lg" />
                        ))}
                    </div>
                    <div className="space-y-1 pt-4">
                        <Skeleton height={12} width={80} className="mb-2 ml-2 bg-gray-100" />
                        {Array.from({ length: 2 }).map((_, i) => (
                            <Skeleton key={i} height={40} className="rounded-lg" />
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                        <Skeleton circle width={36} height={36} />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton width="60%" height={12} />
                            <Skeleton width="30%" height={10} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Skeleton */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="lg:hidden">
                            <Skeleton width={32} height={32} className="rounded-lg" />
                        </div>
                        <div className="space-y-1">
                            <Skeleton width={120} height={18} />
                            <Skeleton width={160} height={12} className="bg-gray-100" />
                        </div>
                    </div>

                    {/* Stats & Actions Area */}
                    <div className="hidden md:flex items-center gap-6">
                        {/* Simulate Dropdown */}
                        <Skeleton width={140} height={36} className="rounded-lg" />

                        {/* Simulate Stats Pill */}
                        <div className="flex bg-gray-50 rounded-lg p-2 gap-4 border border-gray-100">
                            <div className="space-y-1 px-2 text-center border-r border-gray-200">
                                <Skeleton width={60} height={10} className="mx-auto" />
                                <Skeleton width={30} height={16} className="mx-auto" />
                            </div>
                            <div className="space-y-1 px-2 text-center border-r border-gray-200">
                                <Skeleton width={60} height={10} className="mx-auto" />
                                <Skeleton width={30} height={16} className="mx-auto" />
                            </div>
                            <div className="space-y-1 px-2 text-center">
                                <Skeleton width={60} height={10} className="mx-auto" />
                                <Skeleton width={40} height={16} className="mx-auto" />
                            </div>
                        </div>

                        {/* Icons */}
                        <div className="flex gap-2">
                            <Skeleton circle width={36} height={36} />
                            <Skeleton circle width={36} height={36} />
                        </div>
                    </div>
                </header>

                <main className="p-4 lg:p-8 space-y-6 flex-1 bg-gray-50">
                    {/* No Top Grid - Direct 2-Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                        {/* Left Col - Form Skeleton */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                            <Skeleton width={180} height={24} />

                            {/* Form Fields */}
                            <div className="space-y-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton width={80} height={12} />
                                        <Skeleton width="100%" height={40} className="rounded-lg" />
                                    </div>
                                ))}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Skeleton width={60} height={12} />
                                        <Skeleton width="100%" height={40} className="rounded-lg" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton width={60} height={12} />
                                        <Skeleton width="100%" height={40} className="rounded-lg" />
                                    </div>
                                </div>
                            </div>

                            <Skeleton width="100%" height={48} className="rounded-xl mt-4" />
                        </div>

                        {/* Right Col - List Skeleton */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[500px] flex flex-col">
                            <Skeleton width={120} height={24} className="mb-6" />

                            {/* Filters */}
                            <div className="flex flex-col md:flex-row gap-3 mb-6">
                                <Skeleton width={140} height={36} className="rounded-lg" />
                                <Skeleton width={140} height={36} className="rounded-lg" />
                                <Skeleton width={140} height={36} className="rounded-lg" />
                                <Skeleton width="100%" height={36} className="rounded-lg flex-1" />
                            </div>

                            {/* Table */}
                            <div className="flex-1 space-y-4">
                                <div className="flex gap-4 border-b border-gray-100 pb-2">
                                    <Skeleton width="20%" height={16} />
                                    <Skeleton width="15%" height={16} />
                                    <Skeleton width="15%" height={16} />
                                    <Skeleton width="10%" height={16} className="ml-auto" />
                                </div>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex gap-4 items-center py-2 border-b border-gray-50">
                                        <Skeleton width="20%" height={16} />
                                        <Skeleton width="15%" height={14} />
                                        <Skeleton width="15%" height={14} />
                                        <div className="ml-auto flex gap-2">
                                            <Skeleton width={32} height={32} className="rounded" />
                                            <Skeleton width={32} height={32} className="rounded" />
                                            <Skeleton width={32} height={32} className="rounded" />
                                            <Skeleton width={32} height={32} className="rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export const CoordinatorDashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Header Placeholder matching Coordinator Gradient */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-4 md:p-6 shrink-0 relative overflow-hidden h-24">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10 gap-4 md:gap-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-white/10 animate-pulse" />
                        <div className="space-y-2">
                            <Skeleton width={180} height={18} className="bg-white/20" />
                            <Skeleton width={120} height={12} className="bg-white/10" />
                        </div>
                    </div>
                    <div className="hidden md:flex gap-4">
                        <div className="flex flex-col items-end mr-4 gap-1">
                            <Skeleton width={60} height={10} className="bg-white/10" />
                            <Skeleton width={100} height={14} className="bg-white/20" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-8">

                {/* Introduction / Welcome Card Placeholder */}
                <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 flex items-start gap-4">
                    <Skeleton width={50} height={50} className="rounded-xl shrink-0" />
                    <div className="space-y-3 flex-1">
                        <Skeleton width="40%" height={24} />
                        <Skeleton width="90%" height={16} />
                        <Skeleton width="70%" height={16} />
                    </div>
                </div>

                {/* Filters Card Placeholder */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton width="30%" height={14} />
                                <Skeleton width="100%" height={45} className="rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Results List Placeholder */}
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Skeleton width={40} height={40} circle />
                                    <div className="space-y-1">
                                        <Skeleton width={150} height={16} />
                                        <Skeleton width={200} height={12} />
                                    </div>
                                </div>
                                <Skeleton width={100} height={24} className="rounded-full" />
                            </div>
                            <div className="p-4 gap-4 flex flex-col md:flex-row justify-between items-center">
                                <div className="space-y-2 w-full md:w-1/2">
                                    <Skeleton width={80} height={16} />
                                    <Skeleton width={200} height={14} />
                                    <div className="flex gap-2">
                                        <Skeleton width={100} height={20} />
                                        <Skeleton width={100} height={20} />
                                    </div>
                                </div>
                                <Skeleton width={160} height={40} className="rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>

            </main>
        </div>
    );
};
