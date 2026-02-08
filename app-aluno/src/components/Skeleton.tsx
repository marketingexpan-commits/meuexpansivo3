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
            <div className="w-full max-w-md bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out">
                {/* Header Bar */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white shrink-0">
                    <div className="flex items-center gap-2">
                        <Skeleton width={32} height={32} />
                        <Skeleton width={100} height={16} />
                    </div>
                    <div className="flex items-center gap-3">
                        <Skeleton circle width={32} height={32} />
                    </div>
                </div>

                <div className="p-4 md:p-6 flex-1 flex flex-col">
                    {/* Student Info Card */}
                    <div className="bg-blue-50/50 py-3 px-4 rounded-lg border border-blue-100 mb-6">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Skeleton circle width={40} height={40} />
                                <div className="space-y-1">
                                    <Skeleton width={80} height={12} />
                                    <Skeleton width={120} height={10} />
                                </div>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                                <Skeleton width={60} height={10} />
                                <Skeleton width={80} height={10} />
                            </div>
                        </div>
                    </div>

                    {/* Branding/Welcome */}
                    <div className="mb-6">
                        <Skeleton width={180} height={20} className="mb-2" />
                        <Skeleton width={120} height={14} />
                    </div>

                    {/* Grid Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm aspect-square flex flex-col items-center justify-center gap-3">
                                <Skeleton circle width={48} height={48} />
                                <Skeleton width={80} height={12} />
                            </div>
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
            <div className="w-full max-w-md bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out">
                {/* Header Bar */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Skeleton width={100} height={16} />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Skeleton circle width={32} height={32} />
                    </div>
                </div>

                <div className="p-4 md:p-6 flex-1 flex flex-col">
                    {/* Branding Block */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-10 pl-2">
                            <Skeleton width={40} height={40} />
                            <div className="flex flex-col gap-1">
                                <Skeleton width={60} height={10} />
                                <Skeleton width={140} height={20} />
                                <Skeleton width={100} height={10} />
                            </div>
                        </div>

                        <div className="text-left pb-4">
                            <Skeleton width={220} height={14} />
                        </div>

                        {/* Grid Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm aspect-square gap-3">
                                    <Skeleton circle width={48} height={48} />
                                    <Skeleton width={90} height={12} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CoordinatorDashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className="w-full max-w-2xl bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col">
                <div className="p-6 flex-1 flex flex-col bg-gray-50/50">
                    {/* Welcome Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                                <Skeleton width={180} height={24} />
                                <Skeleton width={120} height={14} />
                            </div>
                            <Skeleton circle width={40} height={40} />
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
                            <Skeleton width={32} height={32} />
                            <div className="space-y-1">
                                <Skeleton width={80} height={10} />
                                <Skeleton width={140} height={16} />
                            </div>
                        </div>
                    </div>

                    {/* Menu Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center justify-center gap-4 shadow-sm hover:shadow-md transition-shadow cursor-default h-40">
                                <Skeleton circle width={56} height={56} />
                                <Skeleton width={120} height={16} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
