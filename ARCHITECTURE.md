# Project Architecture & Critical Rules

## 🚫 PROTECTED LOGIC: Frequency Calculation
**Last Updated:** January 13, 2026
**Status:** LOCKED

The frequency calculation logic in this project is **Unit-Specific** and **Dynamic**.
Future AI Agents and Developers: **DO NOT REVERT** this to a static estimation (e.g., "10 weeks fixed").

### The Rule
Frequency percentage MUST be calculated based on the **actual number of school days** in the specific unit's calendar, respecting holidays and recesses.

### The Formula
The divisor for frequency calculation is:
```typescript
expectedClasses = (weeklyClasses / 5) * calculateSchoolDays(startDate, endDate, calendarEvents)
```

### Dependencies
1.  **`calendarEvents`**: Must be fetched from Firestore (`calendar_events`) filtering by the student's Unit ID.
2.  **`AcademicSettings`**: Defines the start/end dates of bimesters.
3.  **`calculateSchoolDays`**: Utility function in `academicUtils.ts` that counts M-F excluding holidays.

### Why?
Each school unit (Zona Norte, Extremoz, etc.) has autonomy over its calendar (feriados regionais, problemas estruturais, etc.). A static estimate breaks synchronization and causes incorrect data for students/parents.

---
