import { AppointmentOrderEditor } from "../../appointment-order-editor"

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AppointmentOrderEditor mode="edit" appointmentId={id} />
}

