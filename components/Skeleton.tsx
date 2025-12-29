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
            <div className="w-full max-w-md bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col">
                <div className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 pb-12 relative shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/10 animate-pulse" />
                        <div className="space-y-2">
                            <Skeleton width={140} height={16} className="bg-white/20" />
                            <Skeleton width={100} height={12} className="bg-white/10" />
                        </div>
                    </div>
                </div>
                <div className="p-6 flex-1 -mt-6 bg-white rounded-t-3xl relative z-10">
                    <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} height={110} className="rounded-2xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const TeacherDashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className="w-full max-w-7xl bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col">
                <div className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 relative shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 animate-pulse" />
                        <div className="space-y-2">
                            <Skeleton width={180} height={20} className="bg-white/20" />
                            <Skeleton width={120} height={14} className="bg-white/10" />
                        </div>
                    </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                    <div className="flex gap-6 mb-8 border-b border-gray-100 pb-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} width={120} height={24} className="rounded" />
                        ))}
                    </div>
                    <div className="flex flex-col md:flex-row gap-8 flex-1">
                        <div className="w-full md:w-1/3 space-y-6">
                            <Skeleton height={180} className="rounded-xl" />
                            <Skeleton height={350} className="rounded-xl" />
                        </div>
                        <div className="w-full md:w-2/3">
                            <Skeleton height="100%" className="rounded-xl min-h-[400px]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdminDashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className="w-full max-w-7xl bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col">
                <div className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 relative shrink-0">
                    <div className="flex flex-row justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white/10 animate-pulse" />
                            <div className="space-y-2">
                                <Skeleton width={200} height={24} className="bg-white/20" />
                                <Skeleton width={140} height={14} className="bg-white/10" />
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <Skeleton width={80} height={32} className="bg-white/10 rounded-full" />
                            <Skeleton width={40} height={40} className="bg-white/10 rounded-full" />
                        </div>
                    </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                    <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} width={130} height={38} className="rounded-lg shrink-0" />
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                        <div className="md:col-span-1">
                            <Skeleton height={600} className="rounded-xl" />
                        </div>
                        <div className="md:col-span-2">
                            <Skeleton height={600} className="rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
