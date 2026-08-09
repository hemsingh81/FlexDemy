namespace FlexDemy.Domain.Users;

// Master: full access, manages any user. Support: reviews Tutor/Student issues.
// Tutor: creates and manages courses. Student: learns -- read-only on course content.
// Unassigned/PendingTutor/RejectedTutor are the profile-completion/approval funnel a
// self-registered user passes through before landing on a terminal role (plan §1):
//   Unassigned --(complete Student form)--> Student                         [terminal]
//   Unassigned --(submit Tutor application)--> PendingTutor
//   PendingTutor --(Support/Master approve)--> Tutor                        [terminal]
//   PendingTutor --(Support/Master reject)--> RejectedTutor
//   RejectedTutor --(re-submit)--> PendingTutor
//   RejectedTutor --(switch to Student)--> Student                         [terminal]
// Role is persisted via .HasConversion<string>() (UserConfiguration.cs), so appending new
// members here is additive-safe -- no backfill needed, existing rows are unaffected.
public enum UserRole
{
    Student,
    Tutor,
    Support,
    Master,
    Unassigned,
    PendingTutor,
    RejectedTutor,
}
