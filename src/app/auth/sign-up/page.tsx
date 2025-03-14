import { Suspense } from "react";
import { LoadingForm } from "../LoadingForm";
import { SignUpForm } from "./SignUpForm";

export const metadata = {
  title: "Sign Up",
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<LoadingForm />}>
      <SignUpForm />
    </Suspense>
  );
}
