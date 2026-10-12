import { Equals, IsBoolean, IsString, Matches } from 'class-validator';

export class LinkPospalMemberDto {
  @IsString()
  @Matches(/^\d{1,20}$/)
  customerUid!: string;

  @IsBoolean()
  @Equals(true)
  identityVerified!: true;
}
