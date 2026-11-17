import { Equals, IsBoolean, IsString, Matches } from 'class-validator';

export class ConfirmPospalMemberSyncDto {
  @IsBoolean()
  @Equals(true)
  identityVerified!: true;
}

export class LinkPospalMemberDto extends ConfirmPospalMemberSyncDto {
  @IsString()
  @Matches(/^\d{1,20}$/)
  customerUid!: string;
}
