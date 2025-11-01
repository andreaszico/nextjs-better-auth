import { getServerSession } from "@/lib/auth/get-session";
import SignOutButton from "../(auth)/components/button-signout"

async function AboutPage() {
    const me = await getServerSession();

    if (!me) {
        return (
            <div>
                <h1>About Us</h1>
                <p>Please log in to see your information.</p>
            </div>
        )
    }

    return (
        <div>
            <h1>About Us</h1>
            <div className="flex w-full flex-col gap-5">
                <h2>Hi, {me.user.name}</h2>
                <p>{me.user.email}</p>
                <p>{me.user.role}</p>
                <SignOutButton />
            </div>
        </div>
    )
}

export default AboutPage