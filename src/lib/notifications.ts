import { prisma } from "./prisma";

export async function notifyConsultantOfDelivery(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { consultant: { include: { user: true } } },
  });
  if (!order || !order.consultant?.user) return;
  if (order.deliveryMode !== "LIVRAISON_JAMAAL") return;

  await prisma.notification.create({
    data: {
      userId: order.consultant.user.id,
      orderId: order.id,
      title: "Colis livré",
      message: `Le colis de ${order.customerName} a été livré directement par nos soins. Vous pouvez informer votre client.`,
    },
  });
}
