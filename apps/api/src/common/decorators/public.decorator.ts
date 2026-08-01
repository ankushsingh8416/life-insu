import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
/** Marks a route as exempt from auth guards (used for health checks, public chat endpoints). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
